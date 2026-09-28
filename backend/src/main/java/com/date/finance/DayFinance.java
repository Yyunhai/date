package com.date.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record DayFinance(LocalDate date, BigDecimal income, BigDecimal expense, BigDecimal balance, List<TxView> items) {
}
