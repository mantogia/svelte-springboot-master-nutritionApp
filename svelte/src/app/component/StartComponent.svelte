<script>
    import { foodListe } from '../stores/stores.js';

    let count = foodListe.length;

</script>

<div class="card">
    <div class="card-header">
        Fragebogen
    </div>
    <div class="card-body">
      <h5 class="card-title">Inhalt</h5>
      <p class="card-text">
        
        Dieser Fragbogen beinhaltet {count} Lebensmittel. 
        Geben Sie bitte an wie gerne Sie einzelne Lebensmittel haben.
        Mit den Angaben wird eine erste Evaluation durchgeführt.
        
      </p>
      <a href="#/questions" class="btn btn-primary">Starten</a>
    </div>
  </div>

  <style>

    

  </style>