package com.date.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record TxView(
        Long id,
        LocalDate date,
        TxType type,
        String typeLabel,
        BigDecimal amount,
        String remark,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    static TxView of(Transaction tx) {
        return new TxView(
                tx.getId(),
                tx.getTxDate(),
                tx.getType(),
                tx.getType().getLabel(),
                tx.getAmount(),
                tx.getRemark(),
                tx.getCreatedAt(),
                tx.getUpdatedAt()
        );
    }
}
