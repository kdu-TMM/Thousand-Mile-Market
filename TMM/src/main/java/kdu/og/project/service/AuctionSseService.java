package kdu.og.project.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import kdu.og.project.dto.AuctionSseMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 경매 SSE(Server-Sent Events) 서비스
 * Redis Pub/Sub 메시지를 구독한 클라이언트에게 브로드캐스트
 */
@Service
@Slf4j
public class AuctionSseService {

    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    private final StringRedisTemplate redisTemplate;
    private final ChannelTopic        topic;
    private final ObjectMapper        objectMapper;

    public AuctionSseService(
            StringRedisTemplate redisTemplate,
            @Qualifier("auctionTopic") ChannelTopic topic,
            ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.topic         = topic;
        this.objectMapper  = objectMapper;
    }

    /** 클라이언트 SSE 구독 등록 */
    public SseEmitter subscribe(Long auctionId) {
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L); // 30분
        String id = auctionId + "_" + System.currentTimeMillis();
        emitters.put(id, emitter);

        emitter.onCompletion(() -> emitters.remove(id));
        emitter.onTimeout(   () -> emitters.remove(id));
        emitter.onError(   e -> emitters.remove(id));

        try {
            // 버퍼 채움용 패딩 포함 connect 이벤트 전송
            String padding = " ".repeat(2048);
            emitter.send(SseEmitter.event()
                    .name("connect")
                    .data("connected!" + padding));
        } catch (IOException e) {
            log.error("SSE 연결 실패", e);
        }

        return emitter;
    }

    /** 입찰 발생 시 Redis에 메시지 발행 */
    public void broadcast(AuctionSseMessage message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            redisTemplate.convertAndSend(topic.getTopic(), json);
        } catch (Exception e) {
            log.error("SSE 발행 실패", e);
        }
    }

    /** Redis Pub/Sub → 구독 클라이언트에게 SSE 전송 (MessageListenerAdapter 콜백) */
    public void handleMessage(String message) {
        try {
            String cleanMessage = message.startsWith("\"") && message.endsWith("\"")
                    ? message.substring(1, message.length() - 1).replace("\\\"", "\"")
                    : message;

            AuctionSseMessage sseMessage = objectMapper.readValue(cleanMessage, AuctionSseMessage.class);
            String auctionIdStr = String.valueOf(sseMessage.getAuctionId());

            log.info("SSE 전송: 경매ID={}, 가격={}", sseMessage.getAuctionId(), sseMessage.getCurrentPrice());

            emitters.forEach((key, emitter) -> {
                if (key.startsWith(auctionIdStr + "_")) {
                    try {
                        emitter.send(SseEmitter.event()
                                .name("refresh")
                                .data(cleanMessage));
                    } catch (Exception e) {
                        emitters.remove(key);
                    }
                }
            });
        } catch (Exception e) {
            log.error("SSE 메시지 처리 중 오류", e);
        }
    }
}
