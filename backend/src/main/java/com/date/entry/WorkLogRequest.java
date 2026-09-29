package com.date.entry;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;

public record WorkLogRequest(
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate date,
        @Min(value = 0, message = "工作时长不能为负") @Max(value = 1440, message = "一天最多 24 小时")
        Integer minutes
) {
}
