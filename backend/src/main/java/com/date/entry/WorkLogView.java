package com.date.entry;

import java.time.LocalDate;

public record WorkLogView(LocalDate date, int minutes) {

    static WorkLogView of(WorkLog log) {
        return new WorkLogView(log.getWorkDate(), log.getMinutes());
    }
}
