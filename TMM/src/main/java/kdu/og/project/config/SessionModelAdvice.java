package kdu.og.project.config;

import jakarta.servlet.http.HttpSession;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@ControllerAdvice
public class SessionModelAdvice {

    @ModelAttribute
    public void addSessionToModel(HttpSession session, Model model) {
        model.addAttribute("sessionUid",      session.getAttribute("uid"));
        model.addAttribute("sessionNickname", session.getAttribute("nickname"));
    }
}
