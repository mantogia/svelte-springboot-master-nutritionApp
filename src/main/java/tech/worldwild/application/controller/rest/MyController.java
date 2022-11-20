package tech.worldwild.application.controller.rest;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class MyController {    


    @GetMapping("/patients")
    public String hallo() { 
        return "hallo velo";
    }

}




