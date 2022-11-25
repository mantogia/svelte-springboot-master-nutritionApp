package tech.worldwild.application.controller.rest;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import tech.worldwild.application.entities.Food;
import tech.worldwild.application.entities.Food_Rating;
import tech.worldwild.application.entities.User;
import tech.worldwild.application.repositories.FoodRepository;
import tech.worldwild.application.repositories.Food_RatingRepository;
import tech.worldwild.application.repositories.UserRepository;

@RestController
class MyController {    

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private FoodRepository foodRepository;

    @Autowired
    private Food_RatingRepository foodRatingRepository;


    @GetMapping("/patients")
    public String hallo() { 
        return "hallo velo";
    }

    @PostMapping("/users")
    User newUser(@RequestBody User newUser){
        return userRepository.save(newUser);
    }

    @PostMapping("/food_ratings/{fk_user_id}/{fk_food_id}/{rating}")
    public ResponseEntity<Food_Rating> newFoodRating(
        @PathVariable("fk_user_id") long id_user, 
        @PathVariable("fk_food_id") long id_food,
        @PathVariable("rating") int rating)
    {
        Optional<User> u = userRepository.findById(id_user);
        Optional<Food> f = foodRepository.findById(id_food);

        if (!u.isEmpty() && !f.isEmpty()) {
			User u1 = u.get();
			Food f1 = f.get();

            Food_Rating fr = new Food_Rating();
            fr.setUser(u1);
            fr.setFood(f1);
            fr.setRating(rating);
            return new ResponseEntity<Food_Rating>(foodRatingRepository.save(fr), HttpStatus.OK);
        } else {

            return new ResponseEntity<Food_Rating>(HttpStatus.NOT_FOUND);
        }

    }
        
        

    @GetMapping("/users/{id}")
    public ResponseEntity<User> getUserByID(@PathVariable("id") Long id) {
        Optional<User> u = userRepository.findById(id);

        if(!u.isEmpty()){
            return new ResponseEntity<User>(u.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<User>(HttpStatus.NOT_FOUND);
        } 
        
    }

    @GetMapping("/foods/{id}")
    public ResponseEntity<Food> getFoodByID(@PathVariable("id") Long id) {
        Optional<Food> f = foodRepository.findById(id);

        if(!f.isEmpty()){
            return new ResponseEntity<Food>(f.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<Food>(HttpStatus.NOT_FOUND);
        } 
        
    }

    @GetMapping("/users/name/{name}")
    public ResponseEntity<User> getUserByName(@PathVariable("name") String name) {
        Optional<User> u = userRepository.findByUserName(name);

        if(!u.isEmpty()){
            return new ResponseEntity<User>(u.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<User>(HttpStatus.NOT_FOUND);
        } 
        
    }


    @GetMapping("/users/{id}/food_ratings")
    public ResponseEntity<List<Food_Rating>> getFoodRatingsByUserId(@PathVariable("id") long id) {
        Optional<User> u = userRepository.findById(id);

        if(!u.isEmpty()){
            return new ResponseEntity<List<Food_Rating>>(u.get().getFood_ratingsObjects(), HttpStatus.OK);
        }else{
            return new ResponseEntity<List<Food_Rating>>(HttpStatus.NOT_FOUND);
        } 
        
    }
}

