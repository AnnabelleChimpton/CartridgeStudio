action_player_shoot
 if shotactive then return
 shotactive = 1 : shotx = playerx + 6 : shoty = PLAYERY - 6
{{sound "shoot"}}
 return
