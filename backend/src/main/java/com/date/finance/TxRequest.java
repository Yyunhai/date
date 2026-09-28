package com.date.finance;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TxRequest(
        @NotBlank(message = "请选择收入还是支出") String type,
        @NotNull(message = "请填写金额")
        @DecimalMin(value = "0.01", message = "金额要大于 0")
        @DecimalMax(value = "9999999999.99", message = "金额超出可记录范围")
        @Digits(integer = 10, fraction = 2, message = "金额最多两位小数") BigDecimal amount,
        @Size(max = 200, message = "备注最多 200 字") String remark,
        LocalDate date
) {
}
