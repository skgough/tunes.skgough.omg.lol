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

end

def query(sql_statement, *args)
  result = SQLite3::Database.open('tunes.db', { results_as_hash: true, readonly: true }) do |db|
    query_result = db.execute(sql_statement, *args)
                     &.map { OpenStruct.new(it) }
    query_result || []
  end 
  return result
end

def write(sql_statement, *args)
  SQLite3::Database.open('tunes.db') do |db|
    db.execute(sql_statement, *args)
  end 
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
  case options
  in message:
    redirect to "/?message=#{message}"
  else
    redirect to '/'
  end
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

  if params.key? :message
    @message = params[:message]
  end

  erb :cms
end

get '/search' do
  begin
    params => { q:, key: }
  rescue NoMatchingPatternKeyError
    status 400
    return
  end

  if [q, key].any?(&:empty?)
    status 400
    return
  end

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
  @results = JSON.parse(request.body)["items"].map {
    {
      id: it.dig("id", "videoId"),
      url: "https://www.youtube.com/watch?v=#{it.dig("id", "videoId")}",
      title: it.dig("snippet", "title"),
      artist: it.dig("snippet", "channelTitle").gsub(" - Topic", ""),
    }
  }
  erb :search_results
end

post '/user/edit' do
  update = <<-SQL
    insert into users 
    values(1, ?, ?)
    on conflict(id) do update
      set username = ?,
          api_key = ?
      where users.id = 1
  SQL
  write update, [
    params[:username], 
    params[:api_key],
    params[:username], 
    params[:api_key]
  ]
  reload with message: "Credentials Saved."
end

post '/track/new' do
  track = <<-SQL
    insert into tracks
    values (?,?,?,?,?,?)
  SQL
  write track, [
    nil,
    params[:yt_id],
    params[:title],
    params[:artist],
    nil,
    Time.now.strftime('%Y-%m-%d %H:%M:%S')
  ]
  rebuild
  reload
end

post '/track/edit' do
  edit = <<-SQL
    update tracks
    set title = ?,
       artist = ?
    where id = ? 
  SQL
  write edit, [
    params[:title],
    params[:artist],
    params[:id]
  ]
  rebuild
  reload
end

post '/track/delete' do
  delete = <<-SQL
    delete from tracks
    where id = ?
  SQL
  write delete, [ params[:id] ]
  rebuild
  reload
end
