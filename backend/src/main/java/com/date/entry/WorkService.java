package com.date.entry;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 按天记的工作时长，和当天的文字记录互不影响 */
@Service
public class WorkService {

    private final WorkLogRepository repository;
    private final Long userId;

    public WorkService(WorkLogRepository repository, @Value("${app.user-id}") Long userId) {
        this.repository = repository;
        this.userId = userId;
    }

    @Transactional(readOnly = true)
    public WorkLogView get(LocalDate date) {
        return repository.findByUserIdAndWorkDate(userId, date)
                .map(WorkLogView::of)
                .orElseGet(() -> new WorkLogView(date, 0));
    }

    @Transactional
    public WorkLogView save(WorkLogRequest request) {
        LocalDate date = request.date() == null ? LocalDate.now() : request.date();
        int minutes = request.minutes() == null || request.minutes() < 0 ? 0 : request.minutes();
        WorkLog log = repository.findByUserIdAndWorkDate(userId, date).orElseGet(() -> {
            WorkLog created = new WorkLog();
            created.setUserId(userId);
            created.setWorkDate(date);
            return created;
        });
        log.setMinutes(minutes);
        // saveAndFlush 让 @PreUpdate 先执行，返回的才是新值
        return WorkLogView.of(repository.saveAndFlush(log));
    }

    /** 今日 / 本周（周一起）/ 本月 / 本年的工作时长汇总 */
    @Transactional(readOnly = true)
    public WorkStats stats(LocalDate date) {
        LocalDate weekStart = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate yearStart = date.withDayOfYear(1);
        LocalDate yearEnd = date.withDayOfYear(date.lengthOfYear());
        YearMonth yearMonth = YearMonth.from(date);

        // 跨年那一周会落到年初之外，所以查询范围取两者并集
        LocalDate from = yearStart.isBefore(weekStart) ? yearStart : weekStart;
        LocalDate to = yearEnd.isAfter(weekEnd) ? yearEnd : weekEnd;
        List<WorkLog> logs = repository.findByUserIdAndWorkDateBetween(userId, from, to);

        return new WorkStats(
                range(logs, date, date),
                range(logs, weekStart, weekEnd),
                range(logs, yearMonth.atDay(1), yearMonth.atEndOfMonth()),
                range(logs, yearStart, yearEnd));
    }

    private static WorkRange range(List<WorkLog> logs, LocalDate start, LocalDate end) {
        int minutes = 0;
        int days = 0;
        for (WorkLog log : logs) {
            LocalDate day = log.getWorkDate();
            if (log.getMinutes() <= 0 || day.isBefore(start) || day.isAfter(end)) {
                continue;
            }
            minutes += log.getMinutes();
            days++;
        }
        return new WorkRange(minutes, days);
    }
}
