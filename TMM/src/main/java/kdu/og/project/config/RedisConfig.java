package kdu.og.project.config;

import kdu.og.project.service.AuctionSseService;
import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Value("${spring.data.redis.host:localhost}")
    private String host;

    @Value("${spring.data.redis.port:6379}")
    private int port;

    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        return new LettuceConnectionFactory(host, port);
    }

    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        return template;
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }

    @Bean
    public RedissonClient redissonClient() {
        Config config = new Config();
        // lazyInitialization=true → Redis 미연결 상태에서도 앱 기동 허용
        // (첫 실제 연산 시점에 연결 시도)
        config.setLazyInitialization(true);
        config.useSingleServer()
              .setAddress("redis://" + host + ":" + port)
              .setConnectTimeout(3000)
              .setTimeout(3000)
              .setRetryAttempts(1)
              .setConnectionMinimumIdleSize(1);
        return Redisson.create(config);
    }

    // ===== Pub/Sub (app.redis.pubsub.enabled=true 일 때만 활성화) =====
    // Redis 서버가 없는 개발 환경에서는 false로 두면 앱이 정상 기동됨
    // Redis 실행 후 true로 변경하면 SSE 실시간 입찰 업데이트가 작동함

    /** 경매 SSE 메시지 리스너 어댑터 — @Lazy로 순환 의존성 방지 */
    @Bean
    @ConditionalOnProperty(name = "app.redis.pubsub.enabled", havingValue = "true")
    public MessageListenerAdapter auctionListenerAdapter(
            @Lazy AuctionSseService auctionSseService) {
        return new MessageListenerAdapter(auctionSseService, "handleMessage");
    }

    @Bean
    @ConditionalOnProperty(name = "app.redis.pubsub.enabled", havingValue = "true")
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory factory,
            MessageListenerAdapter auctionListenerAdapter,
            ChannelTopic auctionTopic) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(auctionListenerAdapter, auctionTopic);
        return container;
    }

    @Bean
    public ChannelTopic auctionTopic() {
        return new ChannelTopic("auction-topic");
    }

    @Bean
    public ChannelTopic notificationTopic() {
        return new ChannelTopic("notification-topic");
    }
}
