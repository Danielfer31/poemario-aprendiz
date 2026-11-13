// Para agregar un poema: añade un objeto a esta lista y guarda su imagen en poemas/img/<id>.webp
// fecha: "YYYY-MM-DD" (o null)   spotify / appleMusic: link de la canción (o null)   nota: opcional
// Si pones los dos links, la página muestra un selector Spotify | Apple Music.
export default [
  {
    id: "maestra",
    titulo: "Maestra",
    fecha: "2026-11-11",
    spotify: "https://open.spotify.com/intl-es/track/35ttE4t8lQZA2vuCYDg4G7?si=2482e30c6e5e4c42",
    appleMusic: "https://music.apple.com/co/album/m-a-i/1724126218?i=1724126234",
    imagen: "poemas/img/maestra.webp",
    texto: `Quien enseña como tu?
Quien tiene esa vocación que tienes tú?
Quien ama lo que hace como lo haces tú?
Quien ve el mundo como lo ves tú?
Tú maestra, soñadora, capaz ¿quién se puede resistir a ser tu discípulo? Si todo lo que quieres hacer es compartir lo que amas`,
  },
  {
    id: "la-maestra-del-fuego",
    titulo: "La Maestra del Fuego",
    fecha: "2026-11-12",
    spotify: "https://open.spotify.com/intl-es/track/0ei64Ivi3kxqHaQuYByc79?si=315e938ba6ec4dfc",
    appleMusic: "https://music.apple.com/co/album/doctora-ii/1625326966?i=1625327469",
    imagen: "poemas/img/la-maestra-del-fuego.webp",
    texto: `¿Quién enseña como tú?
Nadie.
Ni el mendigo que escribe en las paredes,
ni el loco del parque que repite mantras.
Nadie.
Tú, con tu voz de pan y trueno,
tú que me miras y me ordenas:
“aprende a amar, carajo”.

¿Quién ve el mundo como tú?
Nadie.
Tú lo ves como si fuera
una niña perdida que merece ser salvada.

Y yo —
yo que no creía en nada,
te creo a ti.
Y por ti,
aprendo.`,
  },
];
