package com.date.entry;

/** 一个时间区间里的工作时长：总分钟数 + 有记录的天数 */
public record WorkRange(int minutes, int days) {
}
