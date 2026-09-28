package com.date.entry;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class EntryController {

    private final EntryService service;

    public EntryController(EntryService service) {
        this.service = service;
    }

    @GetMapping("/ping")
    public Map<String, Object> ping() {
        return Map.of("status", "ok", "today", LocalDate.now());
    }

    @GetMapping("/entries")
    public List<EntryView> list(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.listByDate(date == null ? LocalDate.now() : date);
    }

    @PostMapping("/entries")
    @ResponseStatus(HttpStatus.CREATED)
    public EntryView create(@Valid @RequestBody EntryRequest request) {
        return service.create(request);
    }

    @PutMapping("/entries/{id}")
    public EntryView update(@PathVariable Long id, @Valid @RequestBody EntryRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/entries/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @GetMapping("/month")
    public List<DayStat> month(@RequestParam int year, @RequestParam int month) {
        return service.monthStat(year, month);
    }
}
