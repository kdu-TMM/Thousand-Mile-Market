package kdu.og.project.dto.chat;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageRequest {

    @NotBlank(message = "채팅방 ID는 필수입니다.")
    private String roomId;

    @NotBlank(message = "발신자 UID는 필수입니다.")
    private String senderUid;

    @NotBlank(message = "발신자 닉네임은 필수입니다.")
    private String senderNickname;

    @NotBlank(message = "메시지 내용은 필수입니다.")
    private String content;
}
