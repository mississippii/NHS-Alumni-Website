package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Counter;
import org.example.nhsbkend.repository.CounterRepository;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Visitor count. The website posts once per browser per day (it remembers the day itself) and only reads on later
 * pages. ponytail: anyone can post more; it's a footer number, not analytics.
 */
@RestController
@RequestMapping("/api/visits")
public class VisitController {

    static final String VISITS = "visits";

    private final CounterRepository counters;

    public VisitController(CounterRepository counters) {
        this.counters = counters;
    }

    @GetMapping
    public Map<String, Long> total() {
        return Map.of("total", counters.findById(VISITS).map(Counter::getTotal).orElse(0L));
    }

    @PostMapping
    @Transactional
    public Map<String, Long> visit() {
        if (counters.bump(VISITS) == 0) counters.save(new Counter(VISITS, 1));
        return total();
    }
}
