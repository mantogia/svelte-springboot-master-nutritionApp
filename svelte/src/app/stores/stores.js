
import { writable } from 'svelte/store';

// Get the value out of storage on load.
const stored = localStorage.current_user

let u =  {
    user_name: "",
    user_email: "",
    user_password: "",
    food_ratings: []

}

export const current_user = writable(u)

current_user.subscribe((value) => localStorage.current_user = value)