require 'sinatra'
require 'sqlite3'
require 'erb'
require 'json'
require 'ostruct'
require 'net/http'

configure do
  SQLite3::Database.open('tunes.db') do |db|
    db.execute <<-SQL
      create table if not exists users (
        id       integer primary key,
        username text unique,
        api_key  text
      )
    SQL
    db.execute <<-SQL
      create table if not exists tracks (
        id         integer primary key,
        yt_id      text unique,
        title      text,
        artist     text,
        vibes      json,
        created_at timestamp
      )
    SQL
    db.execute <<-SQL
      create table if not exists vibes (
        id   integer primary key,
        name text unique
      )
    SQL
  end
  module DeconstructKeys
    def deconstruct_keys(*)
      to_h
    end
  end
  OpenStruct.include DeconstructKeys
end

def execute_sql(sql_statement, options, *args)
  SQLite3::Database.open('tunes.db', { results_as_hash: true}.merge(options)) do |db|
    db.execute(sql_statement, *args)
      &.map { OpenStruct.new(it) }
  end 
end
def query(sql_statement, *args)
  execute_sql(sql_statement, { readonly: true }, *args)
end
def write(sql_statement, *args)
  execute_sql(sql_statement, { readonly: false }, *args)
end

def rebuild
  @username = query(
    <<-SQL
      select * from users
    SQL
  ).first[:username]

  @tracks = query <<-SQL
    select * 
    from tracks 
    order by created_at desc
  SQL

  html = erb :tunes

  File.write('../build/index.html', html)
end

def with(hash)
  hash
end
def reload(options = {})
  if options.key? :message
    session[:message] = options[:message]
  end
  redirect to '/'
end

get '/' do
  @user = query(
    <<-SQL
      select * from users
    SQL
  ).first

  @tracks = query <<-SQL
    select * 
    from tracks 
    order by created_at desc
  SQL
  if session.key? :message
    @message = session[:message]
  end
  session.clear
  erb :cms
end

get '/search' do
  params => { q:, key: }
  uri = URI("https://youtube.googleapis.com/youtube/v3/search")
  uri.query = URI.encode_www_form({
    q:,
    key:,
    part: 'snippet',
    type: 'video',
    videoCategoryId: 10,
    maxResults: 25,
    order: 'relevance'
  })
  request = Net::HTTP.get_response(uri)
  @results = JSON.parse(request.body)["items"].map { |r|
    {
      id: r.dig("id", "videoId"),
      url: "https://www.youtube.com/watch?v=#{r.dig("id", "videoId")}",
      title: r.dig("snippet", "title"),
      artist: r.dig("snippet", "channelTitle").gsub(" - Topic", ""),
    }
  }
  erb :search_results
end

post '/user/edit' do
  params => { username:, api_key: }
  user_update = <<-SQL
    insert into users 
    values(1, ?, ?)
    on conflict(id) do update
      set username = ?,
          api_key = ?
      where users.id = 1
  SQL
  write user_update, [username, api_key, username, api_key]
  reload with message: "Credentials Saved."
end

post '/track/new' do
  params => { yt_id:, title:, artist: }
  track_insert = <<-SQL
    insert into tracks
    values (null, ?, ?, ?, null, CURRENT_TIMESTAMP)
  SQL
  write track_insert, [yt_id, title, artist]
  rebuild
  reload
end

post '/track/edit' do
  params => { title:, artist:, id: }
  track_update = <<-SQL
    update tracks
    set title = ?,
       artist = ?
    where id = ? 
  SQL
  write track_update, [title, artist, id]
  rebuild
  reload
end

post '/track/delete' do
  params => { id: }
  track_deletion = <<-SQL
    delete from tracks
    where id = ?
    returning *
  SQL
  write(track_deletion, [ id ]) => [{ title:, artist: }]
  rebuild
  reload
end
