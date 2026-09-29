package com.date.entry;

import com.date.common.ApiException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EntryService {

    private final EntryRepository repository;
    private final Long userId;

    public EntryService(EntryRepository repository, @Value("${app.user-id}") Long userId) {
        this.repository = repository;
        this.userId = userId;
    }

    @Transactional(readOnly = true)
    public List<EntryView> listByDate(LocalDate date) {
        return repository.findByUserIdAndEntryDateOrderByCreatedAtDesc(userId, date).stream()
                .map(EntryView::of)
                .toList();
    }

    @Transactional
    public EntryView create(EntryRequest request) {
        Entry entry = new Entry();
        entry.setUserId(userId);
        entry.setEntryDate(request.date() == null ? LocalDate.now() : request.date());
        apply(entry, request);
        return EntryView.of(repository.save(entry));
    }

    @Transactional
    public EntryView update(Long id, EntryRequest request) {
        Entry entry = find(id);
        apply(entry, request);
        // saveAndFlush 让 @PreUpdate 先执行，否则返回的 updatedAt 还是旧值
        return EntryView.of(repository.saveAndFlush(entry));
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(find(id));
    }

    @Transactional(readOnly = true)
    public List<DayStat> monthStat(int year, int month) {
        YearMonth yearMonth;
        try {
            yearMonth = YearMonth.of(year, month);
        } catch (Exception e) {
            throw new ApiException(400, "月份参数不合法");
        }
        LocalDate start = yearMonth.atDay(1);
        LocalDate end = yearMonth.atEndOfMonth();

        Map<LocalDate, int[]> grouped = new LinkedHashMap<>();
        for (Entry entry : repository.findByUserIdAndEntryDateBetweenOrderByEntryDateAscCreatedAtAsc(userId, start, end)) {
            int[] counts = grouped.computeIfAbsent(entry.getEntryDate(), key -> new int[3]);
            counts[0]++;
            switch (entry.getCategory()) {
                case WORK -> counts[1]++;
                case DIARY -> counts[2]++;
            }
        }

        List<DayStat> result = new ArrayList<>();
        grouped.forEach((date, counts) -> result.add(new DayStat(date, counts[0], counts[1], counts[2])));
        result.sort(Comparator.comparing(DayStat::date));
        return result;
    }

    private Entry find(Long id) {
        return repository.findById(id)
                .filter(entry -> userId.equals(entry.getUserId()))
                .orElseThrow(() -> new ApiException(404, "记录不存在"));
    }

    private void apply(Entry entry, EntryRequest request) {
        Category category;
        try {
            category = Category.valueOf(request.category().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, "未知的分类: " + request.category());
        }
        entry.setCategory(category);
        entry.setContent(request.content().trim());
    }
}
