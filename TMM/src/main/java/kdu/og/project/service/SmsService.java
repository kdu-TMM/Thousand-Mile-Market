package kdu.og.project.service;

import com.solapi.sdk.SolapiClient;
import com.solapi.sdk.message.exception.SolapiMessageNotReceivedException;
import com.solapi.sdk.message.model.Message;
import com.solapi.sdk.message.service.DefaultMessageService;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Random;
import java.util.concurrent.TimeUnit;

@Service
public class SmsService {

    private static final String CODE_PREFIX     = "SMS:";
    private static final String VERIFIED_PREFIX = "SMS_VERIFIED:";
    private static final long   CODE_TTL        = 5;
    private static final long   VERIFIED_TTL    = 10;

    private final StringRedisTemplate redis;

    @Value("${solapi.api-key:}")
    private String apiKey;

    @Value("${solapi.api-secret:}")
    private String apiSecret;

    @Value("${solapi.sender-phone:}")
    private String senderPhone;

    private DefaultMessageService messageService;

    public SmsService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @PostConstruct
    private void init() {
        if (!apiKey.isBlank() && !apiSecret.isBlank()) {
            messageService = SolapiClient.INSTANCE.createInstance(apiKey, apiSecret);
        }
    }

    /** 인증번호 생성 후 SMS 발송, Redis에 5분 TTL로 저장 */
    public void sendVerificationCode(String phone) {
        if (messageService == null) {
            throw new IllegalStateException("Solapi API 키가 설정되지 않았습니다.");
        }
        String code = generateCode();

        Message message = new Message();
        message.setFrom(senderPhone);
        message.setTo(phone);
        message.setText("[천리마켓] 인증번호는 [" + code + "] 입니다. (5분 이내 입력)");

        try {
            messageService.send(message);
        } catch (SolapiMessageNotReceivedException e) {
            throw new RuntimeException("SMS 발송 실패: " + e.getFailedMessageList(), e);
        } catch (Exception e) {
            throw new RuntimeException("SMS 발송 오류: " + e.getMessage(), e);
        }

        redis.opsForValue().set(CODE_PREFIX + phone, code, CODE_TTL, TimeUnit.MINUTES);
    }

    /** 코드 검증 — 일치하면 검증완료 상태를 10분 TTL로 저장 */
    public boolean verifyCode(String phone, String inputCode) {
        String stored = redis.opsForValue().get(CODE_PREFIX + phone);
        if (stored == null || !stored.equals(inputCode)) return false;

        redis.delete(CODE_PREFIX + phone);
        redis.opsForValue().set(VERIFIED_PREFIX + phone, "true", VERIFIED_TTL, TimeUnit.MINUTES);
        return true;
    }

    /** 전화번호 인증 완료 여부 확인 (회원가입 시 호출) */
    public boolean isVerified(String phone) {
        return "true".equals(redis.opsForValue().get(VERIFIED_PREFIX + phone));
    }

    /** 인증 완료 상태 제거 (회원가입 완료 후 클리어) */
    public void clearVerified(String phone) {
        redis.delete(VERIFIED_PREFIX + phone);
    }

    private String generateCode() {
        return String.format("%06d", new Random().nextInt(1_000_000));
    }
}
