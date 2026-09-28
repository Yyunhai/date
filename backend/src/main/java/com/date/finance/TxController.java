package com.date.finance;

import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transactions")
public class TxController {

    private final TxService service;

    public TxController(TxService service) {
        this.service = service;
    }

    @GetMapping
    public DayFinance list(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.byDate(date == null ? LocalDate.now() : date);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TxView create(@Valid @RequestBody TxRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public TxView update(@PathVariable Long id, @Valid @RequestBody TxRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
