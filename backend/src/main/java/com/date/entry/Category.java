package com.date.entry;

public enum Category {
    WORK("工作"),
    DIARY("日记");

    private final String label;

    Category(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
