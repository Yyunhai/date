package com.date.entry;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EntryRepository extends JpaRepository<Entry, Long> {

    List<Entry> findByUserIdAndEntryDateOrderByCreatedAtDesc(Long userId, LocalDate entryDate);

    List<Entry> findByUserIdAndEntryDateBetweenOrderByEntryDateAscCreatedAtAsc(Long userId, LocalDate start, LocalDate end);
}
