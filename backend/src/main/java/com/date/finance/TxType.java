package com.date.finance;

public enum TxType {
    INCOME("收入"),
    EXPENSE("支出");

    private final String label;

    TxType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
