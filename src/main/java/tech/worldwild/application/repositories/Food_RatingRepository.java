package tech.worldwild.application.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import tech.worldwild.application.entities.Food_Rating;

public interface Food_RatingRepository extends JpaRepository<Food_Rating, Long> {
    
}
