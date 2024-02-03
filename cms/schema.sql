create table if not exists users (
    id       integer primary key,
    username text,
    api_key  text
);

create table if not exists tracks (
    id         integer primary key,
    yt_id      text unique,
    title      text,
    artist     text,
    vibes      json,
    created_at timestamp
);

create table if not exists vibes (
    id   integer primary key,
    name text unique
)
