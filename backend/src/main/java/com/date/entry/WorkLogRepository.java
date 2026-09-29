package com.date.entry;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkLogRepository extends JpaRepository<WorkLog, Long> {

    Optional<WorkLog> findByUserIdAndWorkDate(Long userId, LocalDate workDate);

    List<WorkLog> findByUserIdAndWorkDateBetween(Long userId, LocalDate start, LocalDate end);
}
