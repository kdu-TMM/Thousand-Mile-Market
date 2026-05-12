package kdu.og.project.controller.chat;

import jakarta.validation.Valid;
import kdu.og.project.domain.chat.ChatMessage;
import kdu.og.project.dto.chat.ChatMessageRequest;
import kdu.og.project.dto.chat.ChatMessageResponse;
import kdu.og.project.service.chat.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Controller
@RequiredArgsConstructor
public class WebSocketChatController {

    private final ChatService chatService;
    private final SimpMessageSendingOperations messagingTemplate;

    /**
     * 클라이언트: /app/chat.send
     * 구독:       /topic/chat/{roomId}
     */
    @Transactional
    @MessageMapping("/chat.send")
    public void sendMessage(@Valid @Payload ChatMessageRequest request) {
        log.info("메시지 전송 - roomId: {}, sender: {}", request.getRoomId(), request.getSenderUid());
        try {
            ChatMessage saved = chatService.saveMessage(
                    Long.parseLong(request.getRoomId()),
                    request.getSenderUid(),
                    request.getSenderNickname(),
                    request.getContent()
            );
            ChatMessageResponse response = ChatMessageResponse.from(saved);
            messagingTemplate.convertAndSend("/topic/chat/" + request.getRoomId(), response);
            log.info("메시지 전송 완료 - messageId: {}", saved.getId());
        } catch (Exception e) {
            log.error("메시지 전송 실패: {}", e.getMessage());
        }
    }
}
