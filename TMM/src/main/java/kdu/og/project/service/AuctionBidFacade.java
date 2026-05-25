package kdu.og.project.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RScript;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

/**
 * 경매 입찰 Facade
 * Redis Lua 스크립트로 동시성 제어 후 DB 업데이트
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuctionBidFacade {

    private final RedissonClient  redissonClient;
    private final AuctionService  auctionService;

    /**
     * @return true = 입찰 성공, false = 현재가 이하라 실패
     */
    public boolean bid(Long auctionId, String uid, String nickname,
                       Long bidAmount, LocalDateTime bidTime) {

        String redisKey = "auction_price:" + auctionId;

        // 원자적으로 현재가 비교 후 갱신 (Lua 스크립트)
        String luaScript =
                "local curr = tonumber(redis.call('get', KEYS[1])); " +
                "local bid  = tonumber(ARGV[1]); " +
                "if curr == nil or bid > curr then " +
                "   redis.call('set', KEYS[1], ARGV[1]); " +
                "   return 1; " +
                "else " +
                "   return 0; " +
                "end";

        RScript script = redissonClient.getScript(StringCodec.INSTANCE);
        List<Object> keys   = Collections.singletonList(redisKey);
        Object[]     values = { String.valueOf(bidAmount) };

        Long result = script.eval(
                RScript.Mode.READ_WRITE,
                luaScript,
                RScript.ReturnType.INTEGER,
                keys,
                values
        );

        if (result == null || result == 0) {
            return false;
        }

        log.info("Redis 입찰 성공! DB 업데이트 진행 (경매={}, 금액={})", auctionId, bidAmount);
        auctionService.placeBid(auctionId, uid, nickname, bidAmount, bidTime);
        return true;
    }
}
