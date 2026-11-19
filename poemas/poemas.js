// Para agregar un poema: añade un objeto a esta lista y guarda su imagen en poemas/img/<id>.webp
// fecha: "YYYY-MM-DD" (o null)   spotify / appleMusic: link de la canción (o null)   nota: opcional
// Si pones los dos links, la página muestra un selector Spotify | Apple Music.
// besito: true (opcional) muestra el botón «Manda un besito» en ese poema.
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
  {
    id: "sabor-a-ti",
    titulo: "Sabor a ti",
    fecha: "2026-11-14",
    // Canción: «Sabor a Mí», Luis Miguel (álbum Romances, 1997).
    spotify: "https://open.spotify.com/track/68zSzKkU28AfZvr5FkAUWT",
    appleMusic: "https://music.apple.com/co/album/sabor-a-m%C3%AD/64825320?i=64825291",
    imagen: "poemas/img/sabor-a-ti.webp",
    texto: `Me cantas al odio,
y oigo un ángel,
No lo miro pero lo siento, como quisiera sentirte a ti
Las notas
Yo las noto, pero como si te quisiera notar a ti
Ahi cerca
A mi lado, siento las escalas que me acercan mas a ti
Y me pregunto si que siento es asi de grave
Que un sordo pueda mediante las canciones de amor, sentir como se ama
Que es un beso, que es el verdadero amor.

Quizas lo note, y los unicos álbumes que coleecionen no sean solos cds
Si no estrofas, besos, abrazos, olores, sabores y recuerdos,
Talvez no ganemos un grammy, pero hay algo que he ganado sin buscar y eso eres tu:`,
  },
  {
    id: "sed-de-sol",
    titulo: "Sed de sol",
    fecha: "2026-11-17",
    // Canción: «Ama De Mi Sol», Milo J (álbum La Vida Era Más Corta, 2025).
    spotify: "https://open.spotify.com/track/4GKm1QaEr1tqJwUM0EsUl3",
    appleMusic: "https://music.apple.com/co/album/ama-de-mi-sol/1839970139?i=1839970297",
    imagen: "poemas/img/sed-de-sol.webp",
    texto: `Me aplaca, me lastima, me deja seco.
No encuentro agua y nada más me sacia.
El calor y la temperatura suben por mi cuerpo;
no encuentro control, ni sombra.

El sol alumbra desde las seis, y aun en la noche la temperatura sube más.
No deja de alumbrarme un solo momento, tampoco de calentarme.
Me seco por ti; el agua es un manantial que se vuelve espejismo en el desierto.
Dame algo, solo un poco de ti,
apaga esta sed que tengo.
Dame agua, dame ser, dame algo de ti que apague este calor
o seré otra víctima sin nombre por el daño de otro.
No quiero, no quiero ser otro más.
Quiero ser yo y que seas tú:
tú, el sol, la luna y las estrellas,
y yo, aquel loco que no deja de verlas,
que cada vez encuentra más fascinación al verlas.

No sé si este texto sea "algo",
pero lo que significa vale más que todos los astros.
Según yo, una declaración, un descubrimiento
que me hizo ver que el sol es el centro de mi universo.

Serán palabras de un loco, sin sentido, pero con mucho sentimiento.`,
  },
  {
    id: "dame-un-besito",
    titulo: "Dame un besito",
    fecha: "2026-11-18",
    // Canción: «Dame un Besito», Silvestre Dangond y Juancho de la Espriella (álbum La Fama, 2006).
    spotify: "https://open.spotify.com/track/5BRSSXrqZrvw7tDzmyW50t",
    appleMusic: "https://music.apple.com/co/album/dame-un-besito/309680654?i=309680670",
    imagen: "poemas/img/dame-un-besito.webp",
    besito: true,
    texto: `Dame uno,
no, mejor dos.
Si me das tres tal vez no me dé por vencido,
pero el cuarto es el de la suerte,
o tal vez cinco, como los sentidos.
Aunque si fueran seis no me quejaría,
pero imaginemos que sean siete, como los días de la semana,
o que tal vez, en un ataque de locura, fueran ocho.
Nueve, pero redondeemos a diez,
y el diez no me gusta, mejor que sean veinte.
Tal vez veinte se queden cortos, porque me volveré adicto,
pero quién soy yo para negarme al placer,
para negarme a tus besos,
para negarme a ti.`,
  },
];
