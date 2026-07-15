# Line kalendar

Offline PWA kalendar na zapisovanie uloh, foteni, servisov, oprav, vyletov a veci okolo auta.

## Funkcie

- funguje offline po prvom nacitani
- ulohy sa ukladaju lokalne v prehliadaci
- odskrtavanie splnenych veci
- mesacny kalendar a zoznam najblizsich uloh
- pripomienky 7 dni, 3 dni, 1 den, rano a vo zvoleny cas
- sekcia pre auto: olej, PZP, STK/EK, svetla, pneumatiky

## Spustenie lokalne

```bash
python3 -m http.server 4173
```

Potom otvor:

```text
http://127.0.0.1:4173/
```

Pre PWA instalaciu a service worker je lepsie spustat aplikaciu cez `localhost`, nie priamo ako `file://`.
