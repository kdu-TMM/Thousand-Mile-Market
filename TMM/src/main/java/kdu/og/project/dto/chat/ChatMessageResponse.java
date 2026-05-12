package kdu.og.project.dto.chat;

import kdu.og.project.domain.chat.ChatMessage;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageResponse {

    private Long id;
    private Long roomId;
    private String senderUid;
    private String senderNickname;
    private String content;
    private LocalDateTime sentAt;
    private Boolean isRead;

    public static ChatMessageResponse from(ChatMessage message) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .roomId(message.getRoom().getId())
                .senderUid(message.getSenderUid())
                .senderNickname(message.getSenderNickname())
                .content(message.getContent())
                .sentAt(message.getSentAt())
                .isRead(message.getIsRead())
                .build();
    }
}
