action_wave_next
 wave = wave + 1
 if moveinterval > MININTERVAL then moveinterval = moveinterval - WAVESPEEDUP
 gosub setupwave
{{sound "wave"}}
 return
