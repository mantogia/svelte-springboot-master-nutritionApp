package tech.worldwild.application.entities;




import java.util.ArrayList;
import java.util.List;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.OneToMany;

import com.fasterxml.jackson.annotation.JsonIgnore;


@Entity
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long user_id;
    private String user_name;
    private String  user_email;
    private String  user_password;

    @JsonIgnore
    @OneToMany(mappedBy = "user")
    List<Food_Rating> food_ratings;

    
    public User(String user_name, String user_email, String user_password) {
        this.user_name = user_name;
        this.user_email = user_email;
        this.user_password = user_password;
        this.food_ratings = new ArrayList<Food_Rating>();

    }

    public User() {

    }


    public long getUser_id() {
        return user_id;
    }
    public void setUser_id(long user_id) {
        this.user_id = user_id;
    }
    public String getUser_name() {
        return user_name;
    }
    public void setUser_name(String user_name) {
        this.user_name = user_name;
    }
    public String getUser_email() {
        return user_email;
    }
    public void setUser_email(String user_email) {
        this.user_email = user_email;
    }
    public String getUser_password() {
        return user_password;
    }
    public void setUser_password(String user_password) {
        this.user_password = user_password;
    }

    public List<Long> getFood_ratings() {

        List<Long> result = new ArrayList<Long>();
		for (Food_Rating current : food_ratings ) {
			result.add(current.getId());
		}
		return result;

    }
    @JsonIgnore
    public List<Food_Rating> getFood_ratingsObjects() {

       return food_ratings;
    }

    public void setFood_ratings(List<Food_Rating> food_ratings) {
        this.food_ratings = food_ratings;
    }

   

    
}
