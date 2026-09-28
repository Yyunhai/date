package com.date.entry;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record EntryRequest(
        @NotBlank(message = "请选择分类") String category,
        @NotBlank(message = "内容不能为空") @Size(max = 5000, message = "内容最多 5000 字") String content,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate date
) {
}
