package com.date.finance;

import com.date.common.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TxService {

    private final TransactionRepository repository;
    private final Long userId;

    public TxService(TransactionRepository repository, @Value("${app.user-id}") Long userId) {
        this.repository = repository;
        this.userId = userId;
    }

    @Transactional(readOnly = true)
    public DayFinance byDate(LocalDate date) {
        List<Transaction> rows = repository.findByUserIdAndTxDateOrderByCreatedAtDesc(userId, date);
        BigDecimal income = BigDecimal.ZERO;
        BigDecimal expense = BigDecimal.ZERO;
        for (Transaction tx : rows) {
            if (tx.getType() == TxType.INCOME) {
                income = income.add(tx.getAmount());
            } else {
                expense = expense.add(tx.getAmount());
            }
        }
        List<TxView> items = rows.stream().map(TxView::of).toList();
        return new DayFinance(date, scale(income), scale(expense), scale(income.subtract(expense)), items);
    }

    @Transactional
    public TxView create(TxRequest request) {
        Transaction tx = new Transaction();
        tx.setUserId(userId);
        tx.setTxDate(request.date() == null ? LocalDate.now() : request.date());
        apply(tx, request);
        return TxView.of(repository.save(tx));
    }

    @Transactional
    public TxView update(Long id, TxRequest request) {
        Transaction tx = find(id);
        apply(tx, request);
        return TxView.of(repository.saveAndFlush(tx));
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(find(id));
    }

    private Transaction find(Long id) {
        return repository.findById(id)
                .filter(tx -> userId.equals(tx.getUserId()))
                .orElseThrow(() -> new ApiException(404, "记录不存在"));
    }

    private void apply(Transaction tx, TxRequest request) {
        TxType type;
        try {
            type = TxType.valueOf(request.type().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, "未知的收支类型: " + request.type());
        }
        tx.setType(type);
        tx.setAmount(scale(request.amount()));
        String remark = request.remark() == null ? "" : request.remark().trim();
        tx.setRemark(remark.isEmpty() ? type.getLabel() : remark);
    }

    private BigDecimal scale(BigDecimal value) {
        return value.setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
