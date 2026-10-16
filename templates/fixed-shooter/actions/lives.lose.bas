action_lives_lose
 if gamestate then return
 if lives > 0 then lives = lives - 1
 gamestate = 1 : statetimer = 90
{{sound "lose"}}
 return
