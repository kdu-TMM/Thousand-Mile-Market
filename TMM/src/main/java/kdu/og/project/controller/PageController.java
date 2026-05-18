package kdu.og.project.controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class PageController {

    @GetMapping("/")
    public String index() { return "index"; }

    @GetMapping("/sell")
    public String sell() { return "sell"; }

    @GetMapping("/my-sales")
    public String mySales() { return "my-sales"; }

    @GetMapping("/my-list")
    public String myList() { return "my-list"; }

    @GetMapping("/chat")
    public String chat(HttpSession session, Model model,
                       @RequestParam(required = false) String targetUid,
                       @RequestParam(required = false) String targetNickname,
                       @RequestParam(required = false) String productId,
                       @RequestParam(required = false) String productName) {
        model.addAttribute("loginUid",      session.getAttribute("uid"));
        model.addAttribute("loginNickname", session.getAttribute("nickname"));
        model.addAttribute("initTargetUid",      targetUid);
        model.addAttribute("initTargetNickname", targetNickname);
        model.addAttribute("initProductId",      productId);
        model.addAttribute("initProductName",    productName);
        return "chat";
    }

    @GetMapping("/support")
    public String support() { return "support"; }

    @GetMapping("/mypage")
    public String mypage() { return "mypage"; }

    @GetMapping("/verify")
    public String verify() { return "verify"; }

    @GetMapping("/signup")
    public String signup() { return "signup"; }

    @GetMapping("/product/{id}")
    public String product(@PathVariable String id) { return "product"; }

    @GetMapping("/migrate")
    public String migrate() { return "migrate"; }

    @GetMapping("/admin")
    public String admin() { return "admin"; }
}
