require 'sinatra'
require 'sqlite3'
require 'erb'
require 'json'
require 'ostruct'
require 'net/http'

configure do
  enable :sessions
  set :static_cache_control, [:public, max_age: 60 * 60 * 24 * 365]
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
def url_from(scheme:, host:, path:, query:)
  URI.scheme_list[scheme].build(
    host:, 
    path:, 
    query: URI.encode_www_form(query)
  )
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
  url = url_from(
    scheme: 'HTTPS',
    host: 'youtube.googleapis.com',
    path: '/youtube/v3/search',
    query: {
      q:,
      key:,
      part: 'snippet',
      type: 'video',
      videoCategoryId: 10,
      order: 'relevance',
      maxResults: 25
    }
  )
  search = Net::HTTP.get_response(url)
  @results = JSON.parse(search.body)["items"].map { |r|
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
  reload with message: "Added #{title} by #{artist}"
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
  reload with message: "Updated #{title} by #{artist}"
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
  reload with message: "Deleted #{title} by #{artist}"
end
