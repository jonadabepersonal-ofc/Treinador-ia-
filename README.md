# Treinador-ia-
Treinador ia para watsapp 
import express from "express"
import { createClient } from "@supabase/supabase-js"

const app = express()
app.use(express.json())

const supabase = createClient(
 "https://yhsfjxbvcprkbpovzxta.supabase.co",
 "SUA_ANON_KEY_AQUI"
)

app.post("/webhook", async (req, res) => {

 const phone = req.body.phone
 const message = req.body.message

 const { data } = await supabase
   .from("Atletas")
   .select("*")
   .eq("phone", phone)

 console.log(data)

 res.send("ok")

})

app.listen(3000, () => {
 console.log("Servidor rodando")
})
