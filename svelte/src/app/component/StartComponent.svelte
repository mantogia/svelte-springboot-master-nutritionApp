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
        Geben Sie bitte an, ob Sie die einzelne Lebensmittel mögen oder nicht. Unterscheiden können Sie dabei zwischen "dislike", "like" und "superlike".
        <br><br>
        <b>dislike</b> = dieses Lebensmittel mag ich nicht.<br>
        <b>like</b> = dieses Lebensmittel mag ich.<br>
        <b>superlike</b> = dieses Lebensmittel mag ich <u>sehr</u>.
        <br><br>
        Mit diesen Angaben wird eine erste Evaluation durchgeführt.
        
      </p>
      <a href="#/questions" class="btn btn-primary">Starten</a>
    </div>
  </div>

  <style>

    

  </style>