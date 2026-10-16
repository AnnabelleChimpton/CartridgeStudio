 rem Cartridge Studio M0 toolchain spike: hand-written test program.
 rem A ship moves with the joystick, an enemy bounces on its own,
 rem and holding fire changes the background color.

 displaymode 160A
 set zoneheight 8
 set romsize 32k

 dim playerx = a
 dim playery = b
 dim enemyx = c
 dim enemydx = d

 incgraphic ship.png 160A 0 1 2 3
 incgraphic enemy.png 160A 0 1 2 3

 P0C1 = $3A : P0C2 = $02 : P0C3 = $0F
 P1C1 = $96 : P1C2 = $42 : P1C3 = $90

 playerx = 72 : playery = 150
 enemyx = 20 : enemydx = 1

main
 clearscreen
 if joy0left && playerx > 0 then playerx = playerx - 1
 if joy0right && playerx < 144 then playerx = playerx + 1
 if joy0up && playery > 8 then playery = playery - 1
 if joy0down && playery < 170 then playery = playery + 1
 enemyx = enemyx + enemydx
 if enemyx > 148 then enemydx = 255
 if enemyx < 2 then enemydx = 1
 if joy0fire then BACKGRND = $42 else BACKGRND = $00
 plotsprite ship 0 playerx playery
 plotsprite enemy 1 enemyx 32
 drawscreen
 goto main
