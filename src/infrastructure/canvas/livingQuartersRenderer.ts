import type { Person } from '@/domain'
import type { Scene } from '@/application/session/scene'
import { drawEnemy } from './enemyRenderer'

export function drawLivingQuarters(ctx: CanvasRenderingContext2D, scene: Scene): void {
    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(
        0,
        scene.level.livingQuartersY,
        scene.level.width,
        scene.level.height - scene.level.livingQuartersY,
    )

    ctx.strokeStyle = 'rgba(68, 68, 68, 0.2)'
    ctx.lineWidth = 1
    const gridSize = 50

    for (let x = 0; x < scene.level.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, scene.level.livingQuartersY)
        ctx.lineTo(x, scene.level.height)
        ctx.stroke()
    }

    for (let y = scene.level.livingQuartersY; y < scene.level.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(scene.level.width, y)
        ctx.stroke()
    }

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 5])
    ctx.beginPath()
    ctx.moveTo(0, scene.level.livingQuartersY)
    ctx.lineTo(scene.level.width, scene.level.livingQuartersY)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#888888'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ЖИЛОЙ ОТСЕК', scene.level.width / 2, scene.level.livingQuartersY + 30)

    if (scene.people) {
        scene.people.forEach((person) => {
            if (person.alive) {
                drawPerson(ctx, person)
            }
        })
    }

    if (scene.enemiesInQuarters) {
        scene.enemiesInQuarters.forEach((enemy) => {
            if (enemy.alive) {
                drawEnemy(ctx, enemy)
            }
        })
    }

    if (scene.enemiesInQuarters && scene.enemiesInQuarters.length > 0) {
        ctx.fillStyle = '#ff0000'
        ctx.font = 'bold 20px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(
            '!!! ТРЕВОГА: ВРАГИ В ОТСЕКЕ !!!',
            scene.level.width / 2,
            scene.level.livingQuartersY + 60,
        )

        ctx.fillStyle = '#ffffff'
        ctx.font = '14px monospace'
        ctx.fillText(
            `Военные ведут огонь. Врагов: ${scene.enemiesInQuarters.length}`,
            scene.level.width / 2,
            scene.level.livingQuartersY + 85,
        )
    } else {
        ctx.fillStyle = '#00ff00'
        ctx.font = '14px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(
            'Отсек в безопасности',
            scene.level.width / 2,
            scene.level.livingQuartersY + 60,
        )
    }

    ctx.fillStyle = '#ffffff'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    const alivePeople = scene.people ? scene.people.filter((p) => p.alive) : []
    const aliveMiners = alivePeople.filter((p) => p.type === 'miner').length
    const aliveMilitary = alivePeople.filter((p) => p.type === 'military').length

    ctx.fillText(
        `⚒ Шахтёры: ${scene.miners} (${aliveMiners} активных)`,
        20,
        scene.level.livingQuartersY + 110,
    )
    ctx.fillText(
        `⚔ Военные: ${scene.military} (${aliveMilitary} активных)`,
        20,
        scene.level.livingQuartersY + 130,
    )
}

function drawPerson(ctx: CanvasRenderingContext2D, person: Person): void {
    if (!person.alive) return

    ctx.save()

    if (person.type === 'miner') {
        ctx.fillStyle = '#ffaa00'
        ctx.strokeStyle = '#ff8800'
    } else {
        ctx.fillStyle = '#00ff00'
        ctx.strokeStyle = '#00cc00'
    }

    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.arc(person.x, person.y - 8, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(person.x, person.y - 4)
    ctx.lineTo(person.x, person.y + 6)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(person.x - 5, person.y)
    ctx.lineTo(person.x + 5, person.y)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(person.x, person.y + 6)
    ctx.lineTo(person.x - 3, person.y + 12)
    ctx.moveTo(person.x, person.y + 6)
    ctx.lineTo(person.x + 3, person.y + 12)
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(person.type === 'miner' ? '⚒' : '⚔', person.x, person.y - 15)

    ctx.restore()

    if (person.type === 'military') {
        ctx.save()
        ctx.strokeStyle = '#cccccc'
        ctx.lineWidth = 2
        const weaponLength = 16
        const angle = person.isShooting && person.shootTimer > 0 ? person.shootAngle : 0
        const weaponStartX = person.x
        const weaponStartY = person.y - 4
        const weaponEndX = weaponStartX + Math.cos(angle) * weaponLength
        const weaponEndY = weaponStartY + Math.sin(angle) * weaponLength

        ctx.beginPath()
        ctx.moveTo(weaponStartX, weaponStartY)
        ctx.lineTo(weaponEndX, weaponEndY)
        ctx.stroke()

        if (person.isShooting && person.shootTimer > 0) {
            ctx.fillStyle = '#ffdd55'
            ctx.beginPath()
            ctx.arc(weaponEndX, weaponEndY, 3 + Math.random() * 1.5, 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.restore()
    }
}
