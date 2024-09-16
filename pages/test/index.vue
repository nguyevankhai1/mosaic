<template>
	<canvas ref="canvas" @mousemove="handleMouseMove"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const images = [
	{
		x: 50,
		y: 50,
		width: 100,
		height: 100,
		src: "/img/anh-hoa-anh-dao-dep-2.jpg",
	},
	{
		x: 200,
		y: 50,
		width: 100,
		height: 100,
		src: "/img/anh-hoa-anh-dao-dep-3.jpg",
	},
];
let hoveredImageIndex: number | null = null;

onMounted(() => {
	if (canvas.value) {
		ctx.value = canvas.value.getContext("2d");
		drawImages();
	}
});

function drawImages() {
	if (!ctx.value) return;
	ctx.value.clearRect(0, 0, canvas.value!.width, canvas.value!.height);

	images.forEach((img, index) => {
		const image = new Image();
		image.src = img.src;
		image.onload = () => {
			ctx.value!.drawImage(image, img.x, img.y, img.width, img.height);

			if (hoveredImageIndex === index) {
				ctx.value!.strokeStyle = "red";
				ctx.value!.lineWidth = 5;
				ctx.value!.strokeRect(img.x, img.y, img.width, img.height);
			}
		};
	});
}

function handleMouseMove(event: MouseEvent) {
	const rect = canvas.value!.getBoundingClientRect();
	const mouseX = event.clientX - rect.left;
	const mouseY = event.clientY - rect.top;

	hoveredImageIndex = null;
	images.forEach((img, index) => {
		if (
			mouseX >= img.x &&
			mouseX <= img.x + img.width &&
			mouseY >= img.y &&
			mouseY <= img.y + img.height
		) {
			hoveredImageIndex = index;
		}
	});

	drawImages();
}
</script>
