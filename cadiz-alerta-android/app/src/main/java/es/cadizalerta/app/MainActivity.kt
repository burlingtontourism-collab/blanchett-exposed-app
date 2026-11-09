package es.cadizalerta.app

import android.os.Bundle
import android.os.Build
import android.content.pm.PackageManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private val Navy = Color(0xFF07182D)
private val Panel = Color(0xFF102943)
private val Cyan = Color(0xFF75C8E8)
private val Soft = Color(0xFFB9C9D8)

data class WeatherPlace(val name: String, val lat: Double, val lon: Double)
data class WeatherNow(val place: WeatherPlace, val temp: Int, val feels: Int, val humidity: Int, val wind: Int, val gust: Int, val rainChance: Int, val description: String)

private val places = listOf(
 WeatherPlace("Bahía de Cádiz",36.5271,-6.2886),
 WeatherPlace("El Puerto de Santa María",36.5939,-6.2329),
 WeatherPlace("Jerez de la Frontera",36.6850,-6.1261),
 WeatherPlace("Sanlúcar de Barrameda",36.7781,-6.3515),
 WeatherPlace("Sierra de Cádiz · Ubrique",36.6778,-5.4460),
 WeatherPlace("La Janda · Vejer",36.2521,-5.9672),
 WeatherPlace("Campo de Gibraltar · Algeciras",36.1320,-5.4539),
 WeatherPlace("Tarifa · Estrecho",36.0139,-5.6069)
)

class MainActivity : ComponentActivity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
   requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1001)
  }
  setContent { CadizAlertaApp() }
 }
}

@Composable
fun CadizAlertaApp() {
 var data by remember { mutableStateOf<List<WeatherNow>>(emptyList()) }
 var loading by remember { mutableStateOf(true) }
 var error by remember { mutableStateOf<String?>(null) }
 var lastUpdate by remember { mutableStateOf("Conectando con Open-Meteo…") }
 val scope = rememberCoroutineScope()
 suspend fun refresh() {
  loading = true; error = null
  try {
   data = withContext(Dispatchers.IO) { places.map { fetchWeather(it) } }
   lastUpdate = "Actualizado: " + java.text.SimpleDateFormat("HH:mm", java.util.Locale("es","ES")).format(java.util.Date())
  } catch (e: Exception) { error = "No se han podido actualizar los datos. Comprueba la conexión e inténtalo de nuevo." }
  finally { loading = false }
 }
 LaunchedEffect(Unit) { refresh(); while (true) { delay(5*60*1000L); refresh() } }
 MaterialTheme(colorScheme = darkColorScheme(primary=Cyan, background=Navy, surface=Panel, onBackground=Color.White, onSurface=Color.White)) {
  Scaffold(containerColor=Navy) { padding ->
   LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding=PaddingValues(18.dp), verticalArrangement=Arrangement.spacedBy(14.dp)) {
    item {
     Row(verticalAlignment=Alignment.CenterVertically, horizontalArrangement=Arrangement.SpaceBetween, modifier=Modifier.fillMaxWidth()) {
      Column {
       Text("CÁDIZ ALERTA", color=Cyan, fontSize=13.sp, fontWeight=FontWeight.Bold, letterSpacing=2.sp)
       Text("El tiempo en tu provincia", color=Color.White, fontSize=25.sp, fontWeight=FontWeight.Bold)
       Text(lastUpdate, color=Soft, fontSize=12.sp)
      }
      IconButton(onClick={ scope.launch { refresh() } }) { Icon(Icons.Default.Refresh, contentDescription="Actualizar", tint=Cyan) }
     }
    }
    item {
     Card(colors=CardDefaults.cardColors(containerColor=Panel), shape=RoundedCornerShape(22.dp)) {
      Column(Modifier.padding(18.dp), verticalArrangement=Arrangement.spacedBy(8.dp)) {
       Text("VIGILANCIA PROVINCIAL", color=Cyan, fontWeight=FontWeight.Bold, fontSize=12.sp)
       Text("8 zonas meteorológicas", color=Color.White, fontSize=22.sp, fontWeight=FontWeight.Bold)
       Text("Previsión horaria de lluvia, viento y temperatura para distintos puntos de Cádiz.", color=Soft, fontSize=14.sp)
       Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) { MetricPill("☔","Lluvia"); MetricPill("⚡","Tormentas"); MetricPill("💨","Viento") }
      }
     }
    }
    if (loading && data.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth(), color=Cyan) }
    error?.let { msg -> item { Text(msg, color=Color(0xFFFFB4AB)) } }
    items(data) { WeatherCard(it) }
    item { Text("Previsión: Open-Meteo. Avisos oficiales AEMET y notificaciones push: pendientes de conectar las credenciales del servicio.", color=Soft, fontSize=11.sp) }
   }
  }
 }
}

@Composable private fun MetricPill(icon:String,label:String) {
 Surface(color=Color(0xFF193A56), shape=RoundedCornerShape(30.dp)) { Text("$icon  $label", color=Color.White, modifier=Modifier.padding(horizontal=10.dp,vertical=7.dp), fontSize=11.sp) }
}
@Composable private fun WeatherCard(w:WeatherNow) {
 Card(colors=CardDefaults.cardColors(containerColor=Panel), shape=RoundedCornerShape(18.dp)) {
  Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement=Arrangement.spacedBy(9.dp)) {
   Row(verticalAlignment=Alignment.CenterVertically, horizontalArrangement=Arrangement.SpaceBetween, modifier=Modifier.fillMaxWidth()) {
    Text(w.place.name, color=Color.White, fontWeight=FontWeight.SemiBold, modifier=Modifier.weight(1f))
    Text("${w.temp}°", color=Cyan, fontSize=30.sp, fontWeight=FontWeight.Bold)
   }
   Text(w.description, color=Soft, fontSize=13.sp)
   HorizontalDivider(color=Color(0xFF29435A))
   Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.SpaceBetween) {
    SmallStat("Sensación","${w.feels}°"); SmallStat("Humedad","${w.humidity}%"); SmallStat("Viento","${w.wind} km/h"); SmallStat("Rachas","${w.gust} km/h")
   }
   Text("Probabilidad de lluvia próxima hora: ${w.rainChance}%", color=if(w.rainChance>=70) Color(0xFFFFD180) else Soft, fontSize=12.sp)
  }
 }
}
@Composable private fun SmallStat(label:String,value:String) {
 Column(horizontalAlignment=Alignment.CenterHorizontally) { Text(value,color=Color.White,fontWeight=FontWeight.Bold,fontSize=14.sp); Text(label,color=Soft,fontSize=10.sp) }
}
private fun fetchWeather(place:WeatherPlace):WeatherNow {
 val endpoint="https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability&forecast_days=1&timezone=Europe%2FMadrid"
 val connection=(URL(endpoint).openConnection() as HttpURLConnection).apply { connectTimeout=12000; readTimeout=12000; requestMethod="GET" }
 try {
  val json=JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
  val current=json.getJSONObject("current"); val hourly=json.getJSONObject("hourly")
  val times=hourly.getJSONArray("time"); val probs=hourly.getJSONArray("precipitation_probability")
  val now=current.getString("time"); var index=0
  for(i in 0 until times.length()) { if(times.getString(i)>=now) { index=i; break } }
  return WeatherNow(place,current.getDouble("temperature_2m").toInt(),current.getDouble("apparent_temperature").toInt(),current.getInt("relative_humidity_2m"),current.getDouble("wind_speed_10m").toInt(),current.getDouble("wind_gusts_10m").toInt(),if(index<probs.length()) probs.getInt(index) else 0,weatherDescription(current.getInt("weather_code")))
 } finally { connection.disconnect() }
}
private fun weatherDescription(code:Int):String = when(code) {
 0->"Despejado"; 1,2->"Poco nuboso"; 3->"Nublado"; 45,48->"Niebla"; 51,53,55->"Llovizna"
 61,63,65->"Lluvia"; 66,67->"Lluvia engelante"; 71,73,75->"Nevada"; 80,81,82->"Chubascos"; 95,96,99->"Tormenta"; else->"Condiciones variables"
}
