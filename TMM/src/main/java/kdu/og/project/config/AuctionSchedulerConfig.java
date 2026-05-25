package kdu.og.project.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class AuctionSchedulerConfig {

    @Bean(name = "auctionScheduler")
    public TaskScheduler auctionScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(5);
        scheduler.setThreadNamePrefix("Auction-Scheduler-");
        scheduler.initialize();
        return scheduler;
    }
}
