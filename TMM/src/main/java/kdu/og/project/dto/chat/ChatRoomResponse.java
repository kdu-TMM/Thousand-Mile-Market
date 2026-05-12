package kdu.og.project.dto.chat;

import kdu.og.project.domain.chat.ChatRoom;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomResponse {

    private Long id;
    private String targetUid;
    private String targetNickname;
    private String productId;
    private String productName;
    private String lastMessage;
    private LocalDateTime lastMessageAt;
    private long unreadCount;

    public static ChatRoomResponse from(ChatRoom room, String myUid, long unreadCount) {
        boolean imUser1 = myUid.equals(room.getUser1Uid());
        return ChatRoomResponse.builder()
                .id(room.getId())
                .targetUid(imUser1 ? room.getUser2Uid() : room.getUser1Uid())
                .targetNickname(imUser1 ? room.getUser2Nickname() : room.getUser1Nickname())
                .productId(room.getProductId())
                .productName(room.getProductName())
                .lastMessage(room.getLastMessage())
                .lastMessageAt(room.getLastMessageAt())
                .unreadCount(unreadCount)
                .build();
    }
}
