package com.date.entry;

import java.time.LocalDate;

public record DayStat(LocalDate date, int total, int work, int diary, int secret) {
}
