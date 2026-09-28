package com.date.entry;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EntryView(
        Long id,
        LocalDate date,
        Category category,
        String categoryLabel,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    static EntryView of(Entry entry) {
        return new EntryView(
                entry.getId(),
                entry.getEntryDate(),
                entry.getCategory(),
                entry.getCategory().getLabel(),
                entry.getContent(),
                entry.getCreatedAt(),
                entry.getUpdatedAt()
        );
    }
}
