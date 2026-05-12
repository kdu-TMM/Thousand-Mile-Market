package kdu.og.project.domain.chat;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_rooms", indexes = {
    @Index(name = "idx_room_key", columnList = "room_key"),
    @Index(name = "idx_room_user1", columnList = "user1_uid"),
    @Index(name = "idx_room_user2", columnList = "user2_uid")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_key", nullable = false, unique = true, length = 300)
    private String roomKey;

    @Column(name = "user1_uid", nullable = false, length = 128)
    private String user1Uid;

    @Column(name = "user2_uid", nullable = false, length = 128)
    private String user2Uid;

    @Column(name = "user1_nickname", length = 50)
    private String user1Nickname;

    @Column(name = "user2_nickname", length = 50)
    private String user2Nickname;

    @Column(name = "product_id", length = 100)
    private String productId;

    @Column(name = "product_name", length = 200)
    private String productName;

    @Column(name = "last_message", length = 500)
    private String lastMessage;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public void updateLastMessage(String message, LocalDateTime at) {
        this.lastMessage = message;
        this.lastMessageAt = at;
    }

    public static String generateRoomKey(String uid1, String uid2, String productId) {
        String sorted = uid1.compareTo(uid2) < 0
                ? uid1 + ":" + uid2
                : uid2 + ":" + uid1;
        return (productId != null && !productId.isBlank())
                ? sorted + ":" + productId
                : sorted;
    }
}
